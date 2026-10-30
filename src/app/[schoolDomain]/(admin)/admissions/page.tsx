import React, { Suspense } from "react";
import { cookies } from "next/headers";
import { basePrisma } from "@/lib/tenant-prisma";
import { sanitizeTierSlug } from "@/lib/tenant-tier-utils";
import AdmissionsPipeline from "./AdmissionsPipeline";
import { cacheAside, buildCacheKey } from "@/lib/cache";
import {
  Users,
  FileCheck,
  Award,
  Clock,
  TrendingUp,
} from "lucide-react";
import { getSession } from "@/lib/auth";
import { checkRouteAuthorization, resolveCanonicalDocuments } from "@/lib/admissions.service";
import { ensureTenantAdmissionTracks } from "@/lib/admissions-pipeline.service";

function PipelineSkeleton() {
  return (
    <div className="flex gap-4 overflow-x-auto pb-4 animate-pulse w-full">
      {[1, 2, 3, 4, 5].map((col) => (
        <div key={col} className="min-w-[320px] bg-slate-100 dark:bg-zinc-900/50 rounded-xl p-3 h-[550px] border border-slate-200/60 dark:border-zinc-800/60 space-y-3">
          <div className="h-6 bg-slate-200 dark:bg-zinc-800 rounded-lg w-2/3"></div>
          <div className="h-28 bg-white dark:bg-zinc-900 rounded-lg p-3 border border-slate-200 dark:border-zinc-800"></div>
          <div className="h-28 bg-white dark:bg-zinc-900 rounded-lg p-3 border border-slate-200 dark:border-zinc-800"></div>
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

  // Server-side RBAC validation
  const session = await getSession(undefined, params.schoolDomain);
  const auth = checkRouteAuthorization(session, { resource: "admissions", action: "view" });

  if (!auth.allowed) {
    return (
      <div className="p-8 max-w-xl mx-auto my-12 bg-white dark:bg-zinc-900 border border-rose-200 dark:border-rose-900/50 rounded-2xl text-center shadow-sm">
        <div className="w-12 h-12 bg-rose-100 dark:bg-rose-950 text-rose-600 rounded-2xl flex items-center justify-center mx-auto mb-4 font-bold text-xl">
          ✕
        </div>
        <h2 className="text-xl font-bold text-slate-800 dark:text-zinc-100">403 Forbidden</h2>
        <p className="text-sm text-slate-600 dark:text-zinc-400 mt-2">
          {auth.reason || "Access Denied: You do not have permission to access the Admissions module."}
        </p>
      </div>
    );
  }

  const mutateAuth = checkRouteAuthorization(session, { resource: "admissions", action: "mutate" });
  const canMutate = mutateAuth.canMutate;

  const userRole = (
    session?.role ||
    session?.user?.role ||
    (session as any)?.userRole ||
    ""
  ).toUpperCase();
  const staffRole = (
    session?.staffRole ||
    session?.user?.staffRole ||
    ""
  ).toUpperCase();

  const isTenantAdmin =
    userRole === "ADMIN" ||
    userRole === "SCHOOL_ADMIN" ||
    userRole === "TENANT_ADMIN" ||
    userRole === "SUPER_ADMIN" ||
    userRole === "SUPERADMIN" ||
    staffRole.includes("ADMIN") ||
    staffRole.includes("PRINCIPAL") ||
    staffRole.includes("DIRECTOR") ||
    staffRole.includes("HEADMASTER") ||
    staffRole.includes("HEADMISTRESS") ||
    staffRole.includes("PROPRIETOR");

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

  // Ensure tenant multi-tier admission tracks & sequential stages are provisioned
  const tracks = await ensureTenantAdmissionTracks(school.id);

  // Resolve active tier from URL searchParams or cookie (TierSwitcher selection)
  const cookieStore = await cookies();
  const rawCookieTier = cookieStore.get("activeTier")?.value;
  const cookieTier = rawCookieTier ? decodeURIComponent(rawCookieTier) : undefined;
  const requestedTierParam = searchParams?.tier;
  const activeCandidate = (requestedTierParam || cookieTier || school.academicTiers[0]?.name || "Primary").trim();

  const candidateLower = activeCandidate.toLowerCase();
  const candidateSlug = sanitizeTierSlug(activeCandidate);

  let activeTierType: "university" | "polytechnic" | "college_education" | "secondary" | "primary" | "nursery" = "primary";
  let activeTierDisplayName = "Primary School";
  let tierBadgeLetter = "P";

  if (candidateSlug === "university" || candidateLower.includes("uni") || candidateLower.includes("undergraduate") || candidateLower.includes("higher")) {
    activeTierType = "university";
    activeTierDisplayName = "University";
    tierBadgeLetter = "U";
  } else if (candidateSlug === "polytechnic" || candidateLower.includes("poly") || candidateLower.includes("nd & hnd")) {
    activeTierType = "polytechnic";
    activeTierDisplayName = "Polytechnic";
    tierBadgeLetter = "P";
  } else if (candidateSlug === "college_education" || candidateLower.includes("college") || candidateLower.includes("nce")) {
    activeTierType = "college_education";
    activeTierDisplayName = "College of Education";
    tierBadgeLetter = "C";
  } else if (candidateSlug === "secondary" || (candidateLower.includes("secondary") && !candidateLower.includes("primary")) || candidateLower.includes("jss") || candidateLower.includes("sss")) {
    activeTierType = "secondary";
    activeTierDisplayName = "Secondary School";
    tierBadgeLetter = "S";
  } else if (candidateSlug === "primary" || (candidateLower.includes("primary") && !candidateLower.includes("secondary")) || candidateLower.includes("basic")) {
    activeTierType = "primary";
    activeTierDisplayName = "Primary School";
    tierBadgeLetter = "P";
  } else if (candidateSlug === "nursery" || candidateLower.includes("nursery") || candidateLower.includes("daycare") || candidateLower.includes("creche") || candidateLower.includes("early childhood")) {
    activeTierType = "nursery";
    activeTierDisplayName = "Daycare / Nursery";
    tierBadgeLetter = "N";
  }

  // Find exact matching academic tier record
  const activeTierObj = school.academicTiers.find((t) => {
    const tSlug = sanitizeTierSlug(t.name);
    const tLower = t.name.toLowerCase();

    if (activeTierType === "university") return tSlug === "university" || tLower.includes("university") || tLower.includes("tertiary");
    if (activeTierType === "polytechnic") return tSlug === "polytechnic" || tLower.includes("polytechnic");
    if (activeTierType === "college_education") return tSlug === "college_education" || tLower.includes("college");
    if (activeTierType === "secondary") return (tSlug === "secondary" || tLower.includes("secondary") || tLower.includes("high school")) && !tLower.includes("primary");
    if (activeTierType === "primary") return (tSlug === "primary" || tLower.includes("primary") || tLower.includes("basic")) && !tLower.includes("secondary");
    if (activeTierType === "nursery") return tSlug === "nursery" || tLower.includes("nursery") || tLower.includes("daycare") || tLower.includes("creche");
    return false;
  });

  const whereClause: any = { schoolId: school.id };
  if (activeTierObj) {
    whereClause.tierId = activeTierObj.id;
  } else {
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

  // KPI Funnel Metrics
  const inquiryCount = leads.filter((l) => (l.status || "").toUpperCase() === "INQUIRY").length;
  const appliedCount = leads.filter((l) => (l.status || "").toUpperCase() === "APPLIED" || (l.status || "").toUpperCase() === "DOCS_PENDING").length;
  const interviewCount = leads.filter((l) => (l.status || "").toUpperCase() === "INTERVIEW" || (l.status || "").toUpperCase() === "VERIFIED").length;
  const approvedCount = leads.filter((l) => (l.status || "").toUpperCase() === "APPROVED").length;
  const enrolledCount = leads.filter((l) => (l.status || "").toUpperCase() === "ENROLLED" || (l.status || "").toUpperCase() === "CONVERTED").length;

  return (
    <div className="space-y-6 animate-in fade-in duration-300 w-full min-h-screen flex flex-col">
      {/* 1. HEADER: Admissions & Enrollment + P badge */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-zinc-800 pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-zinc-50">
              Admissions &amp; Enrollment
            </h1>
            <span
              className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-xs font-black bg-blue-600 text-white shadow-xs"
              title={`${activeTierDisplayName} (Tier: ${tierBadgeLetter})`}
            >
              {tierBadgeLetter}
            </span>
          </div>
          <p className="text-slate-500 dark:text-zinc-400 mt-1 text-xs sm:text-sm">
            Track and manage prospective candidates from initial inquiry to entrance assessment and final matriculation.
          </p>
        </div>

        {/* Active Tier indicator */}
        <div className="flex items-center gap-2 shrink-0 self-start sm:self-center">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 border border-slate-200 dark:border-zinc-700">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>{activeTierDisplayName}</span>
          </span>
        </div>
      </header>

      {/* 2. STATS: Top Analytics Row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6 w-full">
        {/* Card 1: INQUIRY */}
        <div className="bg-white dark:bg-zinc-900 rounded-xl p-5 border border-slate-200/80 dark:border-zinc-800 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between gap-1 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
              INQUIRY
            </span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-950/60 flex items-center justify-center text-amber-600 dark:text-amber-400">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-900 dark:text-zinc-50">
              {inquiryCount}
            </p>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
              New leads
            </p>
          </div>
        </div>

        {/* Card 2: DOCS PENDING */}
        <div className="bg-white dark:bg-zinc-900 rounded-xl p-5 border border-slate-200/80 dark:border-zinc-800 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between gap-1 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
              DOCS PENDING
            </span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-950/60 flex items-center justify-center text-amber-600 dark:text-amber-400">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-900 dark:text-zinc-50">
              {appliedCount}
            </p>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
              Awaiting docs
            </p>
          </div>
        </div>

        {/* Card 3: SCREENED */}
        <div className="bg-white dark:bg-zinc-900 rounded-xl p-5 border border-slate-200/80 dark:border-zinc-800 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between gap-1 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
              SCREENED
            </span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/60 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <FileCheck className="w-4 h-4" />
            </div>
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-900 dark:text-zinc-50">
              {interviewCount}
            </p>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
              Verified
            </p>
          </div>
        </div>

        {/* Card 4: OFFERS */}
        <div className="bg-white dark:bg-zinc-900 rounded-xl p-5 border border-slate-200/80 dark:border-zinc-800 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between gap-1 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
              OFFERS
            </span>
            <div className="w-8 h-8 rounded-lg bg-purple-50 dark:bg-purple-950/60 flex items-center justify-center text-purple-600 dark:text-purple-400">
              <Award className="w-4 h-4" />
            </div>
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-900 dark:text-zinc-50">
              {approvedCount}
            </p>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
              Provisional
            </p>
          </div>
        </div>

        {/* Card 5: MATRICULATED */}
        <div className="bg-white dark:bg-zinc-900 rounded-xl p-5 border border-slate-200/80 dark:border-zinc-800 shadow-sm flex flex-col justify-between col-span-2 md:col-span-1">
          <div className="flex items-center justify-between gap-1 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
              MATRICULATED
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-900 dark:text-zinc-50">
              {enrolledCount}
            </p>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
              Enrolled - SIS
            </p>
          </div>
        </div>
      </div>

      {/* 3. PIPELINE & REGISTER WORKSPACE */}
      <Suspense fallback={<PipelineSkeleton />}>
        {(() => {
          const enhancedLeads = leads.map((l) => ({
            ...l,
            resolvedDocuments: resolveCanonicalDocuments(l),
          }));
          return (
            <AdmissionsPipeline
              leads={enhancedLeads as any}
              schoolId={school.id}
              schoolDomain={params.schoolDomain}
              tiers={school.academicTiers}
              schoolName={school.name}
              canMutate={canMutate}
              isTenantAdmin={isTenantAdmin}
              initialTracks={tracks as any}
            />
          );
        })()}
      </Suspense>
    </div>
  );
}
