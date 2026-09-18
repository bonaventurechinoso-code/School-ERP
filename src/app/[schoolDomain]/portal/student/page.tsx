import React from "react";
import { notFound } from "next/navigation";
import { basePrisma } from "@/lib/tenant-prisma";
import { fetchStudentPortalWorkspace } from "@/app/portal/student/actions";
import { StudentPortalClient } from "@/app/portal/student/components/StudentPortalClient";

export default async function TenantStudentPortalPage({
  params: paramsPromise,
  searchParams: searchParamsPromise,
}: {
  params: Promise<{ schoolDomain: string }>;
  searchParams: Promise<{ 
    denied?: string; 
    tier?: string; 
    studentId?: string; 
    loginId?: string;
    tab?: string;
    payment?: string;
  }>;
}) {
  const { schoolDomain } = await paramsPromise;
  const searchParams = await searchParamsPromise;
  const isAccessDenied = searchParams.denied === "true" || searchParams.denied === "1";
  const shouldOpenFinance = searchParams.tab?.toLowerCase() === "finance" || searchParams.payment === "success";

  const school = await basePrisma.school.findUnique({
    where: { subdomain: schoolDomain },
    select: { id: true, name: true, subdomain: true },
  });

  if (!school) {
    return notFound();
  }

  // Load isolated tenant student portal data
  const workspaceData = await fetchStudentPortalWorkspace({
    schoolDomain: school.subdomain,
    studentLoginId: searchParams.studentId || searchParams.loginId,
    tierParam: searchParams.tier,
  });

  if (isAccessDenied) {
    workspaceData.isAccessDenied = true;
  }

  return (
    <StudentPortalClient 
      initialData={workspaceData} 
      initialTab={shouldOpenFinance ? "FINANCE" : undefined}
    />
  );
}
