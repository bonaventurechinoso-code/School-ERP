import React from "react";
import { notFound, redirect } from "next/navigation";
import { basePrisma } from "@/lib/tenant-prisma";
import { getSession } from "@/lib/auth";
import { getCachedSchool } from "@/lib/cache";
import PrincipalPortalClient from "./PrincipalPortalClient";
import { fetchPrincipalPortalInitialData } from "./actions";

export default async function TenantPrincipalPortalPage({
  params: paramsPromise,
  searchParams: searchParamsPromise,
}: {
  params: Promise<{ schoolDomain: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { schoolDomain } = await paramsPromise;
  const searchParams = await searchParamsPromise;

  const validTabs = [
    "overview",
    "streams",
    "schedules",
    "attendance",
    "exams",
    "staff",
    "reports",
    "leaves",
    "profile",
    "security",
    "admissions",
  ] as const;

  const requestedTab = validTabs.includes(searchParams.tab as any)
    ? searchParams.tab!
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
    redirect(`/${schoolDomain}/login?callbackUrl=${encodeURIComponent(`/${schoolDomain}/portal/principal`)}`);
  }

  // 2. Strict Cross-Tenant Boundary Check
  const sessionTenant = (session.schoolDomain || "").toLowerCase().trim();
  const isSuperAdmin = session.role === "SUPER_ADMIN" || Boolean(session.isSuperAdmin);
  const cleanSessionTenant = sessionTenant.replace(/[^a-z0-9]/g, "");
  const cleanTargetTenant = norm.replace(/[^a-z0-9]/g, "");
  if (!isSuperAdmin && cleanSessionTenant && cleanSessionTenant !== cleanTargetTenant) {
    redirect("/access-denied");
  }

  // 3. Role-Based Access Control (RBAC) Guard: PRINCIPAL or ADMIN ONLY
  const userRole = (session.role || session.userRole || "").toUpperCase();
  const isPrincipalOrAdmin = [
    "PRINCIPAL",
    "HEADMASTER",
    "VICE_PRINCIPAL",
    "DIRECTOR",
    "SUPER_ADMIN",
    "SCHOOL_ADMIN",
    "TENANT_ADMIN",
    "ADMIN",
  ].includes(userRole);

  if (!isPrincipalOrAdmin) {
    if (userRole === "STUDENT") {
      redirect(`/${schoolDomain}/portal/student`);
    } else if (userRole === "PARENT") {
      redirect(`/${schoolDomain}/portal/parent`);
    } else if (userRole === "TEACHER" || userRole === "STAFF") {
      redirect(`/${schoolDomain}/portal/staff`);
    } else if (userRole === "BURSAR") {
      redirect(`/${schoolDomain}/portal/bursar`);
    } else {
      redirect("/access-denied");
    }
  }

  // 4. Force Password Change Guard
  const isDemoTenant = schoolDomain?.toLowerCase() === "demo";
  if (!isDemoTenant && session.mustChangePassword) {
    redirect(`/${schoolDomain}/security/change-password?forced=true`);
  }

  const initialData = await fetchPrincipalPortalInitialData(school.id, session.email);

  return (
    <PrincipalPortalClient
      initialData={initialData}
      schoolDomain={school.subdomain}
      defaultTab={requestedTab}
    />
  );
}
