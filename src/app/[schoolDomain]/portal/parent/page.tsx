import React from "react";
import { notFound, redirect } from "next/navigation";
import { basePrisma } from "@/lib/tenant-prisma";
import { getSession } from "@/lib/auth";
import ParentPortalClient from "./ParentPortalClient";
import { fetchParentPortalInitialData } from "./actions";

export default async function TenantParentPortalPage({
  params: paramsPromise,
  searchParams: searchParamsPromise,
}: {
  params: Promise<{ schoolDomain: string }>;
  searchParams: Promise<{
    tab?: string;
    wardId?: string;
    parentEmail?: string;
  }>;
}) {
  const { schoolDomain } = await paramsPromise;
  const searchParams = await searchParamsPromise;

  const validTabs = [
    "overview",
    "attendance",
    "timetable",
    "reportcards",
    "remarks",
    "fees",
    "proof",
    "noticeboard",
    "profile",
    "security",
  ] as const;

  const requestedTab = validTabs.includes(searchParams.tab as any)
    ? searchParams.tab!
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
    redirect(`/${schoolDomain}/login?callbackUrl=${encodeURIComponent(`/${schoolDomain}/portal/parent`)}`);
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

  if (userRole !== "PARENT" && !isAdmin) {
    if (userRole === "STUDENT") {
      redirect(`/${schoolDomain}/portal/student`);
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

  // 5. Data Privacy Scoping: Parents can only view their own linked wards.
  // Admins can inspect a parent's portal using parentEmail search param.
  const parentEmail = isAdmin
    ? (searchParams.parentEmail || session.email)
    : session.email;

  const initialData = await fetchParentPortalInitialData(school.id, parentEmail);

  return (
    <ParentPortalClient
      initialData={initialData}
      schoolDomain={school.subdomain}
      defaultTab={requestedTab}
    />
  );
}
