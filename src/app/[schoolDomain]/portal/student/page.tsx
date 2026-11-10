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
    getSession(undefined, schoolDomain),
  ]);

  if (!school) {
    return notFound();
  }

  // 1. Mandatory Login Authentication Guard
  if (!session) {
    redirect(`/${schoolDomain}/login?callbackUrl=${encodeURIComponent(`/${schoolDomain}/portal/student`)}`);
  }

  // 2. Strict Cross-Tenant Boundary Check
  const sessionTenant = (session.schoolDomain || "").toLowerCase().trim();
  const isSuperAdmin = session.role === "SUPER_ADMIN" || Boolean(session.isSuperAdmin);
  if (!isSuperAdmin && sessionTenant && sessionTenant !== schoolDomain.toLowerCase().trim()) {
    redirect("/access-denied");
  }

  // 3. Role-Based Access Control (RBAC) Guard
  const userRole = (session.role || session.userRole || "").toUpperCase();
  const isAdmin = ["SUPER_ADMIN", "SCHOOL_ADMIN", "TENANT_ADMIN", "ADMIN", "PRINCIPAL", "HEADMASTER"].includes(userRole);

  if (userRole !== "STUDENT" && !isAdmin) {
    if (userRole === "PARENT") {
      redirect(`/${schoolDomain}/portal/parent`);
    } else if (userRole === "TEACHER" || userRole === "STAFF") {
      redirect(`/${schoolDomain}/portal/staff`);
    } else if (userRole === "BURSAR") {
      redirect(`/${schoolDomain}/portal/bursar`);
    } else {
      redirect(`/${schoolDomain}/login`);
    }
  }

  // 4. Force Password Change Guard
  const isDemoTenant = schoolDomain?.toLowerCase() === "demo";
  if (!isDemoTenant && session.mustChangePassword) {
    redirect(`/${schoolDomain}/security/change-password?forced=true`);
  }

  // 5. Data Privacy Scoping: Enrolled students only access their own profile.
  // Admins can inspect a student's portal using studentId/loginId search param.
  const studentIdentifier = isAdmin
    ? (searchParams.studentId || searchParams.loginId || session.email)
    : session.email;

  const initialData = await fetchStudentPortalInitialData(school.id, studentIdentifier);

  return (
    <StudentPortalClient
      initialData={initialData}
      schoolDomain={school.subdomain}
      defaultTab={requestedTab}
    />
  );
}
