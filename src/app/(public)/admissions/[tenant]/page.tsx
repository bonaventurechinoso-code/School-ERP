import React from "react";
import { notFound } from "next/navigation";
import { lookupTenantAdmissionsProfile } from "./actions";
import PublicAdmissionsPortalClient from "./PublicAdmissionsPortalClient";

export default async function PublicTenantAdmissionsPage({
  params: paramsPromise,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant } = await paramsPromise;

  const res = await lookupTenantAdmissionsProfile(tenant);

  if (!res.success || !res.school) {
    notFound();
  }

  return (
    <PublicAdmissionsPortalClient
      school={res.school as any}
      paymentSettings={res.paymentSettings}
    />
  );
}

