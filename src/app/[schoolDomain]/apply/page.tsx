import React from "react";
import { basePrisma, getTenantClient } from "@/lib/tenant-prisma";
import PublicApplyForm from "./PublicApplyForm";

export default async function ApplyPage({ params: paramsPromise }: { params: Promise<{ schoolDomain: string }> }) {
  const params = await paramsPromise;
  const school = await basePrisma.school.findUnique({
    where: { subdomain: params.schoolDomain },
    include: { academicTiers: true },
  });

  if (!school) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-slate-800">School Not Found</h2>
          <p className="text-slate-500 mt-2">No school registered under domain: {params.schoolDomain}</p>
        </div>
      </div>
    );
  }

  const tenantDb = getTenantClient(school.id);
  const classrooms = await tenantDb.classroom.findMany();

  const brandColor = (school as any).branding?.primaryColor || "#0f172a";

  return (
    <div className="min-h-screen flex items-center justify-center p-4 py-12 bg-slate-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50 transition-colors duration-300">
      <div className="w-full max-w-3xl">
        <PublicApplyForm 
          schoolName={school.name}
          schoolDomain={school.subdomain}
          tiers={school.academicTiers}
          classrooms={classrooms}
          brandColor={brandColor}
        />
      </div>
    </div>
  );
}
