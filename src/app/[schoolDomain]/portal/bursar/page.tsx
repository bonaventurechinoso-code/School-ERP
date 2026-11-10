import React from "react";
import { notFound, redirect } from "next/navigation";
import { basePrisma } from "@/lib/tenant-prisma";
import { getSession } from "@/lib/auth";
import BursarPortalClient from "./BursarPortalClient";
import { fetchBursarPortalInitialData } from "./actions";

export default async function TenantBursarPortalPage({
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
    "fees",
    "invoices",
    "expenses",
    "ledger",
    "payments",
    "payroll",
    "arrears",
    "profile",
    "security",
    "application-fees",
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
    redirect(`/${schoolDomain}/login?callbackUrl=${encodeURIComponent(`/${schoolDomain}/portal/bursar`)}`);
  }

  // 2. Strict Cross-Tenant Boundary Check
  const sessionTenant = (session.schoolDomain || "").toLowerCase().trim();
  const isSuperAdmin = session.role === "SUPER_ADMIN" || Boolean(session.isSuperAdmin);
  if (!isSuperAdmin && sessionTenant && sessionTenant !== schoolDomain.toLowerCase().trim()) {
    redirect("/access-denied");
  }

  // 3. Role-Based Access Control (RBAC) Guard: BURSAR or ADMIN ONLY
  const userRole = (session.role || session.userRole || "").toUpperCase();
  const isBursarOrAdmin = [
    "BURSAR",
    "ACCOUNTANT",
    "FINANCE_OFFICER",
    "SUPER_ADMIN",
    "SCHOOL_ADMIN",
    "TENANT_ADMIN",
    "ADMIN",
    "PRINCIPAL",
  ].includes(userRole);

  if (!isBursarOrAdmin) {
    if (userRole === "STUDENT") {
      redirect(`/${schoolDomain}/portal/student`);
    } else if (userRole === "PARENT") {
      redirect(`/${schoolDomain}/portal/parent`);
    } else if (userRole === "TEACHER" || userRole === "STAFF") {
      redirect(`/${schoolDomain}/portal/staff`);
    } else {
      redirect("/access-denied");
    }
  }

  // 4. Force Password Change Guard
  const isDemoTenant = schoolDomain?.toLowerCase() === "demo";
  if (!isDemoTenant && session.mustChangePassword) {
    redirect(`/${schoolDomain}/security/change-password?forced=true`);
  }

  const initialData = await fetchBursarPortalInitialData(school.id, session.email);

  return (
    <BursarPortalClient
      initialData={initialData}
      schoolDomain={school.subdomain}
      defaultTab={requestedTab}
    />
  );
}
