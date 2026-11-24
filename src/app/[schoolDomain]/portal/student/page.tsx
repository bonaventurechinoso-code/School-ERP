import React from "react";
import { notFound, redirect } from "next/navigation";
import { basePrisma } from "@/lib/tenant-prisma";
import { getSession } from "@/lib/auth";
import { getCachedSchool } from "@/lib/cache";
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

  const norm = (schoolDomain || "").toLowerCase().trim();
  const [cachedSchool, session] = await Promise.all([
    getCachedSchool(norm),
    getSession(undefined, norm),
  ]);

  let school = cachedSchool;
  if (!school) {
    school = await basePrisma.school.findFirst({
      where: {
        OR: [
          { subdomain: { equals: norm, mode: "insensitive" } },
          { slug: { equals: norm, mode: "insensitive" } },
        ],
      },
      include: {
        academicTiers: { orderBy: { level: "asc" } },
      },
    });

    if (!school) {
      const cleanSub = norm.replace(/[^a-z0-9]/g, "");
      const allSchools = await basePrisma.school.findMany({
        select: { id: true, subdomain: true, slug: true },
      });
      const match = allSchools.find((s) => {
        const sub = (s.subdomain || "").toLowerCase().replace(/[^a-z0-9]/g, "");
        const slg = (s.slug || "").toLowerCase().replace(/[^a-z0-9]/g, "");
        return sub === cleanSub || slg === cleanSub;
      });
      if (match) {
        school = await basePrisma.school.findUnique({
          where: { id: match.id },
          include: { academicTiers: { orderBy: { level: "asc" } } },
        });
      }
    }
  }

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
  const cleanSessionTenant = sessionTenant.replace(/[^a-z0-9]/g, "");
  const cleanTargetTenant = norm.replace(/[^a-z0-9]/g, "");
  if (!isSuperAdmin && cleanSessionTenant && cleanSessionTenant !== cleanTargetTenant) {
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
