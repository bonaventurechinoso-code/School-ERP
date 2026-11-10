import React from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { basePrisma } from "@/lib/tenant-prisma";
import { getSession } from "@/lib/auth";
import { ShieldAlert, Briefcase, LogOut, ArrowLeft } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import StaffPortalClient from "./StaffPortalClient";
import { fetchStaffPortalInitialData } from "./actions";

export default async function TenantStaffPortalPage({
  params: paramsPromise,
  searchParams: searchParamsPromise,
}: {
  params: Promise<{ schoolDomain: string }>;
  searchParams: Promise<{ denied?: string; tab?: string }>;
}) {
  const { schoolDomain } = await paramsPromise;
  const searchParams = await searchParamsPromise;
  const isAccessDenied = searchParams.denied === "true" || searchParams.denied === "1";
  const validTabs = [
    "overview",
    "rosters",
    "attendance",
    "gradebook",
    "schedule",
    "lessons",
    "leaves",
    "payslips",
    "circulars",
    "research",
    "profile",
    "security",
  ] as const;
  const requestedTab = validTabs.includes(searchParams.tab as any)
    ? (searchParams.tab as typeof validTabs[number])
    : "overview";

  const [school, session] = await Promise.all([
    basePrisma.school.findUnique({
      where: { subdomain: schoolDomain },
      include: {
        academicTiers: {
          orderBy: { level: "asc" },
        },
      },
    }),
    getSession(undefined, schoolDomain),
  ]);

  if (!school) {
    return notFound();
  }

  // 1. Mandatory Login Authentication Guard
  if (!session) {
    redirect(`/${schoolDomain}/login?callbackUrl=${encodeURIComponent(`/${schoolDomain}/portal/staff`)}`);
  }

  // 2. Strict Cross-Tenant Boundary Check
  const sessionTenant = (session.schoolDomain || "").toLowerCase().trim();
  const isSuperAdmin = session.role === "SUPER_ADMIN" || Boolean(session.isSuperAdmin);
  if (!isSuperAdmin && sessionTenant && sessionTenant !== schoolDomain.toLowerCase().trim()) {
    redirect("/access-denied");
  }

  // 3. Role-Based Access Control (RBAC) Guard
  const userRole = (session.role || session.userRole || "").toUpperCase();
  const isStaffAuthorized = [
    "TEACHER",
    "STAFF",
    "INSTRUCTOR",
    "BURSAR",
    "PRINCIPAL",
    "HEADMASTER",
    "SCHOOL_ADMIN",
    "TENANT_ADMIN",
    "SUPER_ADMIN",
    "ADMIN",
  ].includes(userRole);

  if (!isStaffAuthorized) {
    if (userRole === "STUDENT") {
      redirect(`/${schoolDomain}/portal/student`);
    } else if (userRole === "PARENT") {
      redirect(`/${schoolDomain}/portal/parent`);
    } else {
      redirect(`/${schoolDomain}/login`);
    }
  }

  // 4. Force Password Change Guard
  const isDemoTenant = schoolDomain?.toLowerCase() === "demo";
  if (!isDemoTenant && session.mustChangePassword) {
    redirect(`/${schoolDomain}/security/change-password?forced=true`);
  }

  const initialData = await fetchStaffPortalInitialData(school.id, session.email);

  const staffName = initialData.staffProfile
    ? `${initialData.staffProfile.firstName} ${initialData.staffProfile.lastName}`
    : session?.email
    ? session.email.split("@")[0].replace(/[._-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
    : "Staff Educator";
  const staffRole = initialData.staffProfile?.role || session?.staffRole || "Class Teacher";

  return (
    <StaffPortalClient
      schoolId={school.id}
      schoolName={school.name}
      schoolDomain={school.subdomain}
      staffName={staffName}
      staffRole={staffRole}
      staffProfile={initialData.staffProfile}
      initialPayroll={initialData.payrollRecords}
      initialTimetable={initialData.timetable}
      initialTiers={initialData.tiers}
      initialClassrooms={initialData.classrooms}
      initialCourses={initialData.courses}
      initialStudents={initialData.students}
      initialLessonNotes={initialData.lessonNotes}
      initialLeaveRequests={initialData.leaveRequests}
      defaultTab={requestedTab}
      isAccessDenied={isAccessDenied}
    />
  );
}
