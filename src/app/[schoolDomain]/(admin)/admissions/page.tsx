import React, { Suspense } from "react";
import Link from "next/link";
import { cookies } from "next/headers";
import { basePrisma } from "@/lib/tenant-prisma";
import { sanitizeTierSlug } from "@/lib/tenant-tier-utils";
import AdmissionsPipeline from "./AdmissionsPipeline";
import { cacheAside, buildCacheKey } from "@/lib/cache";
import {
  Users,
  FileCheck,
  Award,
  CheckCircle2,
  Clock,
  TrendingUp,
  UserPlus,
} from "lucide-react";

function PipelineSkeleton() {
  return (
    <div className="flex-1 grid grid-cols-1 md:grid-cols-5 gap-4 animate-pulse">
      {[1, 2, 3, 4, 5].map((col) => (
        <div key={col} className="bg-slate-100 dark:bg-zinc-900/50 rounded-2xl p-4 h-[600px] border border-slate-200/60 dark:border-zinc-800/60">
          <div className="h-6 bg-slate-200 dark:bg-zinc-800 rounded-lg mb-4 w-2/3"></div>
          <div className="space-y-3">
            <div className="h-28 bg-white dark:bg-zinc-900 rounded-xl p-3 border border-slate-200 dark:border-zinc-800"></div>
            <div className="h-28 bg-white dark:bg-zinc-900 rounded-xl p-3 border border-slate-200 dark:border-zinc-800"></div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default async function AdmissionsPage({
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
      }
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

  // Resolve active tier from URL searchParams or cookie
  const cookieStore = await cookies();
  const cookieTier = cookieStore.get("activeTier")?.value;
  const requestedTierParam = searchParams?.tier;

  const activeTierObj = requestedTierParam
    ? school.academicTiers.find(
        (t) =>
          sanitizeTierSlug(t.name) === sanitizeTierSlug(requestedTierParam) ||
          t.name.toLowerCase().includes(requestedTierParam.toLowerCase())
      )
    : null;

  const activeTierName = activeTierObj ? activeTierObj.name : (requestedTierParam || "");

  // Query leads with optional tier filtering
  const whereClause: any = { schoolId: school.id };
  if (activeTierObj) {
    whereClause.tierId = activeTierObj.id;
  }

  const cacheKey = buildCacheKey({
    tenantId: school.id,
    table: "admissions",
    action: "pipeline_tiered",
    filters: { tierId: activeTierObj?.id || "ALL" },
  });

  const leads = await cacheAside({
    key: cacheKey,
    ttlSeconds: 900,
    fetchFn: async () => {
      return basePrisma.admissionLead.findMany({
        where: whereClause,
        include: { tier: true },
        orderBy: { createdAt: "desc" },
        take: 200,
      });
    },
  });

  // KPI Funnel Metrics
  const totalLeads = leads.length;
  const inquiryCount = leads.filter((l) => l.status === "INQUIRY").length;
  const appliedCount = leads.filter((l) => l.status === "APPLIED").length;
  const interviewCount = leads.filter((l) => l.status === "INTERVIEW").length;
  const approvedCount = leads.filter((l) => l.status === "APPROVED").length;
  const enrolledCount = leads.filter((l) => l.status === "ENROLLED").length;
  const conversionRate = totalLeads > 0 ? Math.round((enrolledCount / totalLeads) * 100) : 0;

  return (
    <div className="space-y-8 animate-in fade-in duration-500 h-full flex flex-col">
      {/* HEADER & TIER SWITCHER */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-zinc-800 pb-5">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight text-slate-800 dark:text-zinc-100">
            Admissions & Enrollment CRM
          </h2>
          <p className="text-slate-500 dark:text-zinc-400 mt-1 text-sm sm:text-base">
            Track and manage prospective candidates from initial inquiry to entrance assessment and final matriculation.
          </p>
        </div>

        {/* Academic Tier Switcher Navigation */}
        {school.academicTiers.length > 0 && (
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-zinc-800/80 rounded-2xl border border-slate-200 dark:border-zinc-700/80 overflow-x-auto shrink-0">
            <Link
              href={`/${params.schoolDomain}/admissions`}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                !requestedTierParam
                  ? "bg-white dark:bg-zinc-900 text-indigo-600 dark:text-indigo-400 shadow-xs"
                  : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              All Tiers ({totalLeads})
            </Link>
            {school.academicTiers.map((tier) => {
              const isSelected = activeTierName.toLowerCase() === tier.name.toLowerCase();
              return (
                <Link
                  key={tier.id}
                  href={`/${params.schoolDomain}/admissions?tier=${encodeURIComponent(tier.name)}`}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                    isSelected
                      ? "bg-white dark:bg-zinc-900 text-indigo-600 dark:text-indigo-400 shadow-xs"
                      : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/50"
                  }`}
                >
                  {tier.name}
                </Link>
              );
            })}
          </div>
        )}
      </header>

      {/* 5-STAGE ADMISSIONS FUNNEL COCKPIT */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {/* Stage 1: Inquiries */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 border-t-4 border-t-amber-500">
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-400 font-bold text-[10px] uppercase tracking-wider">Inquiries</span>
            <Users className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-3xl font-black text-slate-800">{inquiryCount}</p>
        </div>

        {/* Stage 2: Applications & KYC */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 border-t-4 border-t-blue-500">
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-400 font-bold text-[10px] uppercase tracking-wider">Screening & KYC</span>
            <FileCheck className="w-4 h-4 text-blue-500" />
          </div>
          <p className="text-3xl font-black text-slate-800">{appliedCount}</p>
        </div>

        {/* Stage 3: Entrance Exam & Interview */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 border-t-4 border-t-purple-500">
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-400 font-bold text-[10px] uppercase tracking-wider">Exams & Interview</span>
            <Clock className="w-4 h-4 text-purple-500" />
          </div>
          <p className="text-3xl font-black text-slate-800">{interviewCount}</p>
        </div>

        {/* Stage 4: Provisional Offers */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 border-t-4 border-t-indigo-500">
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-400 font-bold text-[10px] uppercase tracking-wider">Offers Extended</span>
            <Award className="w-4 h-4 text-indigo-500" />
          </div>
          <p className="text-3xl font-black text-slate-800">{approvedCount}</p>
        </div>

        {/* Stage 5: Enrolled & Conversion Rate */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 border-t-4 border-t-emerald-500 col-span-2 md:col-span-1">
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-400 font-bold text-[10px] uppercase tracking-wider">Matriculated</span>
            <TrendingUp className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-3xl font-black text-slate-800">
            {enrolledCount}
            <span className="text-xs font-normal text-slate-400 ml-1">({conversionRate}% Conv.)</span>
          </p>
        </div>
      </div>

      <Suspense fallback={<PipelineSkeleton />}>
        <AdmissionsPipeline
          leads={leads as any}
          schoolId={school.id}
          schoolDomain={params.schoolDomain}
          tiers={school.academicTiers}
          schoolName={school.name}
        />
      </Suspense>
    </div>
  );
}
