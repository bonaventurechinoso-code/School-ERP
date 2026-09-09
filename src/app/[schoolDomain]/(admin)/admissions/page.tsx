import React from "react";
import { basePrisma, getTenantClient } from "@/lib/tenant-prisma";
import AdmissionsPipeline from "./AdmissionsPipeline";

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

  const tenantDb = getTenantClient(school.id);
  
  const leads = await tenantDb.admissionLead.findMany({
    include: { tier: true },
    orderBy: { createdAt: "desc" }
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-500 h-full flex flex-col">
      <header>
        <h2 className="text-3xl font-extrabold tracking-tight text-slate-800">
          Admissions Management
        </h2>
        <p className="text-slate-500 mt-2 text-lg">
          Track and manage applicant progress from initial inquiry to final enrollment.
        </p>
      </header>

      <AdmissionsPipeline leads={leads} schoolId={school.id} tiers={school.academicTiers} />
    </div>
  );
}
