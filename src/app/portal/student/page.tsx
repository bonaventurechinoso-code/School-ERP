import React from "react";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { fetchStudentPortalWorkspace } from "./actions";
import { StudentPortalClient } from "./components/StudentPortalClient";

export default async function StudentPortalPage({
  searchParams: searchParamsPromise,
}: {
  searchParams: Promise<{ 
    denied?: string; 
    schoolDomain?: string; 
    school?: string; 
    tier?: string;
    studentId?: string;
    loginId?: string;
  }>;
}) {
  const searchParams = await searchParamsPromise;
  const isAccessDenied = searchParams.denied === "true" || searchParams.denied === "1";
  const schoolDomain = searchParams.schoolDomain || searchParams.school || "";
  const tierParam = searchParams.tier;
  const studentLoginId = searchParams.studentId || searchParams.loginId;

  const session = await getSession();
  const targetDomain = schoolDomain || session?.schoolDomain || "york";
  const isDemoTenant = targetDomain.toLowerCase() === "demo";
  if (!isDemoTenant && session?.mustChangePassword) {
    redirect(`/${targetDomain}/security/change-password?forced=true`);
  }

  // Pass through dynamic tenant connection factory and fetch workspace
  const workspaceData = await fetchStudentPortalWorkspace({
    schoolDomain: schoolDomain || undefined,
    studentLoginId: studentLoginId || undefined,
    tierParam: tierParam || undefined,
  });

  if (isAccessDenied) {
    workspaceData.isAccessDenied = true;
  }

  return <StudentPortalClient initialData={workspaceData} />;
}
