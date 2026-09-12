import React, { Suspense } from "react";
import { basePrisma } from "@/lib/tenant-prisma";
import AdmissionsPipeline from "./AdmissionsPipeline";
import { cacheAside, buildCacheKey } from "@/lib/cache";

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

export default async function AdmissionsPage({ params: paramsPromise }: { params: Promise<{ schoolDomain: string }> }) {
  const params = await paramsPromise;
  const school = await basePrisma.school.findUnique({
    where: { subdomain: params.schoolDomain },
    include: { academicTiers: true },
  });

  if (!school) {
    return (
      <div className="p-8 text-center text-slate-500">
        <h2 className="text-xl font-bold text-slate-800">Tenant Not Found</h2>
      </div>
    );
  }

  const cacheKey = buildCacheKey({
    tenantId: school.id,
    table: "admissions",
    action: "pipeline",
  });

  const leads = await cacheAside({
    key: cacheKey,
    ttlSeconds: 1800,
    fetchFn: async () => {
      return basePrisma.admissionLead.findMany({
        where: { schoolId: school.id },
        include: { tier: true },
        orderBy: { createdAt: "desc" },
        take: 100, // Safe indexed fetch bound
      });
    },
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-500 h-full flex flex-col">
      <header>
        <h2 className="text-3xl font-extrabold tracking-tight text-slate-800 dark:text-zinc-100">
          Admissions Management
        </h2>
        <p className="text-slate-500 dark:text-zinc-400 mt-2 text-lg">
          Track and manage applicant progress from initial inquiry to final enrollment.
        </p>
      </header>

      <Suspense fallback={<PipelineSkeleton />}>
        <AdmissionsPipeline leads={leads as any} schoolId={school.id} schoolDomain={params.schoolDomain} tiers={school.academicTiers} />
      </Suspense>
    </div>
  );
}
