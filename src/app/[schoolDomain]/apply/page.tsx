import React from "react";
import { cookies } from "next/headers";
import { basePrisma, getTenantClient } from "@/lib/tenant-prisma";
import PublicApplyForm from "./PublicApplyForm";

export default async function ApplyPage({
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

  // 1. Resolve school tier for domain / trial-sandbox
  const cookieStore = await cookies();
  const rawCookieTier = cookieStore.get("activeTier")?.value;
  const cookieTier = rawCookieTier ? decodeURIComponent(rawCookieTier) : undefined;
  const requestedTier = (searchParams?.tier || cookieTier || "").trim();

  // Find matching tier record if exists in school.academicTiers
  const matchedTier = school.academicTiers.find((t) => {
    if (!requestedTier) return false;
    const tLower = t.name.toLowerCase();
    const reqLower = requestedTier.toLowerCase();
    return tLower === reqLower || tLower.includes(reqLower) || reqLower.includes(tLower);
  });

  const schoolTier = matchedTier?.name || requestedTier || school.academicTiers[0]?.name || "Secondary School";
  const initialTierId = matchedTier?.id || school.academicTiers[0]?.id || "";

  // Log tier to console first as requested
  console.log(`[ApplyPage] Active school tier for ${params.schoolDomain}:`, {
    schoolTier,
    initialTierId,
    requestedTier,
    cookieTier,
    searchParamTier: searchParams?.tier,
  });

  const tenantDb = getTenantClient(school.id);
  const classrooms = await tenantDb.classroom.findMany();

  const brandColor = (school as any).branding?.primaryColor || "#0f172a";

  return (
    <div className="min-h-screen flex items-center justify-center p-4 py-12 bg-slate-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50 transition-colors duration-300">
      <div className="w-full max-w-3xl">
        <PublicApplyForm 
          schoolName={school.name}
          schoolDomain={school.subdomain}
          schoolTier={schoolTier}
          tiers={school.academicTiers}
          initialTierId={initialTierId}
          classrooms={classrooms}
          brandColor={brandColor}
        />
      </div>
    </div>
  );
}
