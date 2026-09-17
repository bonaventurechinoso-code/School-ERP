import React, { Suspense } from "react";
import { cookies } from "next/headers";
import { basePrisma, getPrismaClientForTier } from "@/lib/tenant-prisma";
import { sanitizeTierSlug } from "@/lib/tenant-tier-utils";
import StudentTable from "./StudentTable";
import { fetchStudentsPaginated } from "./actions";

export default async function StudentsPage({ 
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
  }) || school.academicTiers[0];

  const activeTierName = activeTierObj ? activeTierObj.name : "";

  // Dynamically resolve and query the isolated database client
  const tenantDb = await getPrismaClientForTier(school.id, activeTierName);
  
  // High-performance cursor pagination and indexed counts (scalable to millions of records)
  const [
    studentsPagination,
    totalEnrolled,
    suspendedStudents,
    alumniCount,
    activeProspects,
    totalApplicants,
    classrooms,
  ] = await Promise.all([
    fetchStudentsPaginated(school.id, {
      tierName: activeTierName,
      tierId: activeTierObj?.id,
      status: "ENROLLED",
      limit: 25,
    }),
    tenantDb.student.count({
      where: {
        schoolId: school.id,
        status: "ENROLLED",
        ...(activeTierObj ? { tierId: activeTierObj.id } : {}),
      },
    }).catch(() => 0),
    tenantDb.student.count({
      where: {
        schoolId: school.id,
        status: "SUSPENDED",
        ...(activeTierObj ? { tierId: activeTierObj.id } : {}),
      },
    }).catch(() => 0),
    tenantDb.student.count({
      where: {
        schoolId: school.id,
        status: "ALUMNI",
        ...(activeTierObj ? { tierId: activeTierObj.id } : {}),
      },
    }).catch(() => 0),
    basePrisma.admissionLead.count({
      where: {
        schoolId: school.id,
        ...(activeTierObj ? { tierId: activeTierObj.id } : {}),
        status: "INQUIRY",
      },
    }).catch(() => 0),
    basePrisma.admissionLead.count({
      where: {
        schoolId: school.id,
        ...(activeTierObj ? { tierId: activeTierObj.id } : {}),
        status: { in: ["APPLIED", "INTERVIEW", "APPROVED"] },
      },
    }).catch(() => 0),
    tenantDb.classroom.findMany({
      where: {
        schoolId: school.id,
        ...(activeTierObj ? { tierId: activeTierObj.id } : {}),
      },
      orderBy: { name: "asc" },
    }).catch(() => []),
  ]);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl sm:text-2xl md:text-3xl font-black tracking-tight text-slate-900 dark:text-white flex flex-wrap items-center gap-2 sm:gap-3">
          <span>Student Roster</span>
          {activeTierObj && (
            <span className="text-[11px] sm:text-xs uppercase tracking-wider px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-full font-extrabold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
              {activeTierObj.name}
            </span>
          )}
        </h2>
      </header>
      
      <Suspense fallback={
        <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-zinc-800 animate-pulse space-y-4">
          <div className="h-8 bg-slate-100 dark:bg-zinc-800 rounded-lg w-1/4"></div>
          <div className="space-y-2">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-12 bg-slate-50 dark:bg-zinc-800/50 rounded-lg"></div>
            ))}
          </div>
        </div>
      }>
        <StudentTable 
          students={studentsPagination.items as any}
          initialNextCursor={studentsPagination.nextCursor}
          initialHasMore={studentsPagination.hasMore}
          schoolId={school.id} 
          tiers={school.academicTiers}
          activeTier={activeTierName}
          classrooms={classrooms}
          initialMetrics={{
            totalEnrolled,
            suspendedStudents,
            alumniCount,
            activeProspects,
            totalApplicants,
          }}
        />
      </Suspense>
      
    </div>
  );
}
