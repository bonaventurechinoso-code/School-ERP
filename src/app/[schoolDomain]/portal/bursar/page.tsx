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
    getSession(),
  ]);

  if (!school) {
    return notFound();
  }

  const isDemoTenant = schoolDomain?.toLowerCase() === "demo";
  if (!isDemoTenant && session?.mustChangePassword) {
    redirect(`/${schoolDomain}/security/change-password?forced=true`);
  }

  const initialData = await fetchBursarPortalInitialData(school.id, session?.email);

  return (
    <BursarPortalClient
      initialData={initialData}
      schoolDomain={school.subdomain}
      defaultTab={requestedTab}
    />
  );
}
