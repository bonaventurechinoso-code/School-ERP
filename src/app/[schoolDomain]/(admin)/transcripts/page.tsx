import React from "react";
import { notFound } from "next/navigation";
import { basePrisma, getTenantClient, getPrismaClientForTier } from "@/lib/tenant-prisma";
import { aggregateTranscripts } from "@/lib/gpa";
import AnnualBroadsheetClient from "./AnnualBroadsheetClient";
import { fetchAnnualBroadsheet } from "./actions";

export default async function TranscriptsPage({
  params: paramsPromise,
  searchParams: searchParamsPromise,
}: {
  params: Promise<{ schoolDomain: string }>;
  searchParams?: Promise<{ tier?: string; className?: string; session?: string }>;
}) {
  const { schoolDomain } = await paramsPromise;
  const searchParams = searchParamsPromise ? await searchParamsPromise : {};

  // 1. Fetch Tenant School
  const school = await basePrisma.school.findUnique({
    where: { subdomain: schoolDomain },
    include: { academicTiers: true },
  });

  if (!school) {
    return notFound();
  }

  const academicTiersList = school.academicTiers.map((t) => t.name);
  const defaultTier =
    searchParams?.tier ||
    academicTiersList.find((t) => t.toLowerCase().includes("secondary")) ||
    academicTiersList[0] ||
    "Secondary School";
  
  const defaultClass = searchParams?.className || (defaultTier.toLowerCase().includes("primary") ? "Primary 1" : "JSS 1");
  const academicSession = searchParams?.session || "2026/2027";

  // 2. Fetch Annual Broadsheet Data
  const broadsheetData = await fetchAnnualBroadsheet(school.id, {
    className: defaultClass,
    tierName: defaultTier,
    academicYear: academicSession,
  });

  // 3. Fetch All Active Students for the Transcripts Directory
  const tenantDb = await getPrismaClientForTier(school.id, defaultTier);
  const studentsRaw = await tenantDb.student.findMany({
    where: { 
      schoolId: school.id,
      status: { in: ["ACTIVE", "ENROLLED"] } 
    },
    include: {
      tier: true,
      ExamResult: {
        include: {
          exam: {
            include: { course: true },
          },
        },
      },
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });

  const studentDirectory = studentsRaw.map((s) => {
    const { cumulativeGPA } = aggregateTranscripts(s.ExamResult);
    return {
      id: s.id,
      name: `${s.lastName}, ${s.firstName}`,
      admissionNumber: s.admissionNumber,
      currentClass: s.currentClass,
      tierName: s.tier?.name || defaultTier,
      status: s.status,
      cumulativeGPA,
    };
  });

  return (
    <AnnualBroadsheetClient
      schoolId={school.id}
      schoolDomain={schoolDomain}
      schoolName={school.name}
      initialStudents={studentDirectory}
      initialBroadsheet={broadsheetData.broadsheet}
      initialStats={broadsheetData.stats}
      initialTier={defaultTier}
      initialClass={defaultClass}
      academicYear={academicSession}
      academicTiers={academicTiersList}
    />
  );
}
