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
    getSession(),
  ]);

  if (!school) {
    return notFound();
  }

  const isDemoTenant = schoolDomain?.toLowerCase() === "demo";
  if (!isDemoTenant && session?.mustChangePassword) {
    redirect(`/${schoolDomain}/security/change-password?forced=true`);
  }

  const parentEmail = searchParams.parentEmail || session?.email;
  const initialData = await fetchParentPortalInitialData(school.id, parentEmail);

  return (
    <ParentPortalClient
      initialData={initialData}
      schoolDomain={school.subdomain}
      defaultTab={requestedTab}
    />
  );
}
