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

  // Determine effective academic tiers for this tenant
  let effectiveTiers = school.academicTiers;
  if (!effectiveTiers || effectiveTiers.length === 0) {
    if ((school as any).tierDatabases && (school as any).tierDatabases.length > 0) {
      effectiveTiers = (school as any).tierDatabases.map((td: any) => {
        let name = "Secondary School";
        const tn = (td.tierName || "").toUpperCase();
        if (tn.includes("CRECHE") || tn.includes("NURSERY")) name = "Creche / Nursery";
        else if (tn.includes("PRIMARY")) name = "Primary School";
        else if (tn.includes("TERTIARY") || tn.includes("HIGHER")) name = "Higher Education";
        return {
          id: td.id,
          schoolId: school.id,
          name,
          level: 1,
          databaseUrl: td.databaseUrl,
          databaseName: td.databaseName,
          tierDatabaseId: td.id,
          createdAt: td.createdAt,
          updatedAt: td.updatedAt,
        } as any;
      });
    } else {
      const sName = (school.name || "").toLowerCase();
      let defaultTierName = "Secondary School";
      if (sName.includes("primary") || sName.includes("basic") || sName.includes("elementary")) {
        defaultTierName = "Primary School";
      } else if (sName.includes("creche") || sName.includes("nursery") || sName.includes("creche")) {
        defaultTierName = "Creche / Nursery";
      } else if (sName.includes("university") || sName.includes("college") || sName.includes("polytechnic")) {
        defaultTierName = "Higher Education";
      }

      effectiveTiers = [
        {
          id: "default-tier",
          schoolId: school.id,
          name: defaultTierName,
          level: 1,
          databaseUrl: null,
          databaseName: null,
          tierDatabaseId: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as any,
      ];
    }
  }

  // 1. Resolve school tier for domain / trial-sandbox
  const cookieStore = await cookies();
  const rawCookieTier = cookieStore.get("activeTier")?.value;
  const cookieTier = rawCookieTier ? decodeURIComponent(rawCookieTier).trim() : undefined;
  const queryTier = searchParams?.tier ? searchParams.tier.trim() : undefined;

  // Strict tenant-tier isolation: candidate tier must match an actual registered tier for this tenant
  const candidateTier = queryTier || cookieTier;
  const matchedTier = effectiveTiers.find((t) => {
    if (!candidateTier) return false;
    const tLower = t.name.toLowerCase();
    const candLower = candidateTier.toLowerCase();
    return tLower === candLower || tLower.includes(candLower) || candLower.includes(tLower);
  });

  // If candidate tier does not belong to this school, strictly fallback to the school's registered tier
  const activeTierObj = matchedTier || effectiveTiers[0];
  const schoolTier = activeTierObj?.name || "Secondary School";
  const initialTierId = activeTierObj?.id || "";

  // Log tier to console for traceability
  console.log(`[ApplyPage] Active school tier for ${params.schoolDomain}:`, {
    schoolTier,
    initialTierId,
    candidateTier,
    matchedTier: matchedTier?.name,
    effectiveTiers: effectiveTiers.map((t) => t.name),
  });

  let classrooms: any[] = [];
  try {
    const tenantDb = getTenantClient(school.id);
    classrooms = await tenantDb.classroom.findMany();
  } catch (err) {
    console.warn(`[ApplyPage] Could not fetch tenant classrooms for ${school.id}:`, err);
    classrooms = [];
  }

  const brandColor = (school as any).branding?.primaryColor || "#0f172a";

  return (
    <div className="min-h-screen flex items-center justify-center p-4 py-12 bg-slate-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50 transition-colors duration-300">
      <div className="w-full max-w-3xl">
        <PublicApplyForm 
          schoolName={school.name}
          schoolDomain={school.subdomain}
          schoolTier={schoolTier}
          tiers={effectiveTiers}
          initialTierId={initialTierId}
          classrooms={classrooms}
          brandColor={brandColor}
        />
      </div>
    </div>
  );
}
