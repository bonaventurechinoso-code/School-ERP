import React from "react";
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
