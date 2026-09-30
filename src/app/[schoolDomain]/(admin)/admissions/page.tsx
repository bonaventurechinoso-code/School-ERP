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

  // Resolve active tier from URL searchParams or cookie (cookie = sidebar TierSwitcher selection)
  const cookieStore = await cookies();
  const rawCookieTier = cookieStore.get("activeTier")?.value;
  const cookieTier = rawCookieTier ? decodeURIComponent(rawCookieTier) : undefined;
  const requestedTierParam = searchParams?.tier;
  const activeCandidate = (requestedTierParam || cookieTier || school.academicTiers[0]?.name || "University").trim();

  // Normalize candidate tier into canonical system types
  const candidateLower = activeCandidate.toLowerCase();
  const candidateSlug = sanitizeTierSlug(activeCandidate);

  let activeTierType: "university" | "polytechnic" | "college_education" | "secondary" | "primary" | "nursery" = "primary";
  let activeTierDisplayName = "Primary School";

  if (candidateSlug === "university" || candidateLower.includes("uni") || candidateLower.includes("undergraduate") || candidateLower.includes("higher")) {
    activeTierType = "university";
    activeTierDisplayName = "University";
  } else if (candidateSlug === "polytechnic" || candidateLower.includes("poly") || candidateLower.includes("nd & hnd")) {
    activeTierType = "polytechnic";
    activeTierDisplayName = "Polytechnic";
  } else if (candidateSlug === "college_education" || candidateLower.includes("college") || candidateLower.includes("nce")) {
    activeTierType = "college_education";
    activeTierDisplayName = "College of Education";
  } else if (candidateSlug === "secondary" || (candidateLower.includes("secondary") && !candidateLower.includes("primary")) || candidateLower.includes("jss") || candidateLower.includes("sss")) {
    activeTierType = "secondary";
    activeTierDisplayName = "Secondary School";
  } else if (candidateSlug === "primary" || (candidateLower.includes("primary") && !candidateLower.includes("secondary")) || candidateLower.includes("basic")) {
    activeTierType = "primary";
    activeTierDisplayName = "Primary School";
  } else if (candidateSlug === "nursery" || candidateLower.includes("nursery") || candidateLower.includes("daycare") || candidateLower.includes("creche") || candidateLower.includes("early childhood")) {
    activeTierType = "nursery";
    activeTierDisplayName = "Daycare / Nursery";
  }

  // Find exact matching academic tier record for the active tenant
  const activeTierObj = school.academicTiers.find((t) => {
    const tSlug = sanitizeTierSlug(t.name);
    const tLower = t.name.toLowerCase();

    if (activeTierType === "university") {
      return (
        tSlug === "university" ||
        tLower.includes("university") ||
        tLower.includes("higher institution") ||
        tLower.includes("tertiary")
      );
    }
    if (activeTierType === "polytechnic") {
      return (
        tSlug === "polytechnic" ||
        tLower.includes("polytechnic") ||
        tLower.includes("higher institution")
      );
    }
    if (activeTierType === "college_education") {
      return (
        tSlug === "college_education" ||
        tLower.includes("college") ||
        tLower.includes("higher institution")
      );
    }
    if (activeTierType === "secondary") {
      return (
        (tSlug === "secondary" || tLower.includes("secondary") || tLower.includes("high school")) &&
        !tLower.includes("primary")
      );
    }
    if (activeTierType === "primary") {
      return (
        (tSlug === "primary" || tLower.includes("primary") || tLower.includes("basic")) &&
        !tLower.includes("secondary")
      );
    }
    if (activeTierType === "nursery") {
      return (
        tSlug === "nursery" ||
        tLower.includes("nursery") ||
        tLower.includes("daycare") ||
        tLower.includes("creche")
      );
    }
    return false;
  });

  // Query leads strictly for the active tier to enforce tier isolation
  const whereClause: any = { schoolId: school.id };
  if (activeTierObj) {
    whereClause.tierId = activeTierObj.id;
  } else {
    // If tenant does not have this tier, return 0 leads rather than leaking records
    whereClause.tierId = "non-existent-tier-boundary";
  }

  const cacheKey = buildCacheKey({
    tenantId: school.id,
    table: "admissions",
    action: "pipeline_tiered",
    filters: {
      tierId: activeTierObj?.id || activeTierType,
      activeTierType,
    },
  });

  const leads = await cacheAside({
    key: cacheKey,
    ttlSeconds: 60,
    fetchFn: async () => {
      return basePrisma.admissionLead.findMany({
        where: whereClause,
        include: { tier: true },
        orderBy: { createdAt: "desc" },
        take: 200,
      });
    },
  });

  // KPI Funnel Metrics - strictly computed from active tier leads
  const totalLeads = leads.length;
  const inquiryCount = leads.filter((l) => l.status === "INQUIRY").length;
  const appliedCount = leads.filter((l) => l.status === "APPLIED").length;
  const interviewCount = leads.filter((l) => l.status === "INTERVIEW").length;
  const approvedCount = leads.filter((l) => l.status === "APPROVED").length;
  const enrolledCount = leads.filter((l) => l.status === "ENROLLED").length;
  const conversionRate = totalLeads > 0 ? Math.round((enrolledCount / totalLeads) * 100) : 0;

  return (
    <div className="space-y-8 animate-in fade-in duration-500 h-full flex flex-col">
      {/* HEADER & TIER BOUNDARY ISOLATION */}
      {/* Bug 1 fix: flex-col on mobile, flex-row on desktop (lg:) with nowrap title */}
      <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-200 dark:border-zinc-800 pb-5 lg:flex-nowrap">
        <div className="min-w-0 lg:shrink-0 lg:max-w-none">
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-800 dark:text-zinc-100 lg:whitespace-nowrap">
            Admissions &amp; Enrollment
          </h2>
          <p className="text-slate-500 dark:text-zinc-400 mt-1 text-sm sm:text-base">
            Track and manage prospective candidates from initial inquiry to entrance assessment and final matriculation.
          </p>
        </div>

        {/* Bug 2 fix: Tier boundary enforcement — show ONLY the active tier tab/indicator */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-zinc-800/80 rounded-2xl border border-slate-200 dark:border-zinc-700/80 shrink-0">
          <span
            className="px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap bg-white dark:bg-zinc-900 text-indigo-600 dark:text-indigo-400 shadow-xs flex items-center gap-2"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            {activeTierDisplayName} ({totalLeads})
          </span>
        </div>
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
