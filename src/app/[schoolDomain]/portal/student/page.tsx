import React from "react";
import { notFound, redirect } from "next/navigation";
import { basePrisma } from "@/lib/tenant-prisma";
import { getSession } from "@/lib/auth";
import StudentPortalClient from "./StudentPortalClient";
import { fetchStudentPortalInitialData } from "./actions";

export default async function TenantStudentPortalPage({
  params: paramsPromise,
  searchParams: searchParamsPromise,
}: {
  params: Promise<{ schoolDomain: string }>;
  searchParams: Promise<{
    tab?: string;
    studentId?: string;
    loginId?: string;
    payment?: string;
  }>;
}) {
  const { schoolDomain } = await paramsPromise;
  const searchParams = await searchParamsPromise;

  const validTabs = [
    "overview",
    "attendance",
    "timetable",
    "assignments",
    "reportcards",
    "noticeboard",
    "resources",
    "fees",
    "profile",
    "security",
  ] as const;

  const requestedTab = validTabs.includes(searchParams.tab as any)
    ? searchParams.tab!
    : searchParams.payment === "success"
    ? "fees"
    : "overview";

  const [school, session] = await Promise.all([
    basePrisma.school.findFirst({
      where: {
        OR: [
          { subdomain: schoolDomain.toLowerCase().trim() },
          { slug: schoolDomain.toLowerCase().trim() },
        ],
      },
    }),
    getSession(),
  ]);

  if (!school) {
    return notFound();
  }

  const isDemoTenant = schoolDomain?.toLowerCase() === "demo";
  if (!isDemoTenant && session?.mustChangePassword) {
    redirect(`/${schoolDomain}/security/change-password?forced=true`);
  }

  const studentIdentifier = searchParams.studentId || searchParams.loginId || session?.email;
  const initialData = await fetchStudentPortalInitialData(school.id, studentIdentifier);

  return (
    <StudentPortalClient
      initialData={initialData}
      schoolDomain={school.subdomain}
      defaultTab={requestedTab}
    />
  );
}
