import React from "react";
import { notFound } from "next/navigation";
import { basePrisma } from "@/lib/tenant-prisma";
import { fetchAdmissionsReconciliationsQueue } from "./actions";
import AdmissionsReconciliationsClient from "./AdmissionsReconciliationsClient";

export default async function AdmissionsReconciliationsPage({
  params: paramsPromise,
}: {
  params: Promise<{ schoolDomain: string }>;
}) {
  const { schoolDomain } = await paramsPromise;

  const school = await basePrisma.school.findFirst({
    where: {
      OR: [
        { subdomain: schoolDomain.toLowerCase().trim() },
        { slug: schoolDomain.toLowerCase().trim() },
        { id: schoolDomain },
      ],
    },
    select: { id: true, name: true, subdomain: true },
  });

  if (!school) {
    notFound();
  }

  const { transactions } = await fetchAdmissionsReconciliationsQueue(school.id);

  return (
    <AdmissionsReconciliationsClient
      initialTransactions={transactions as any}
      schoolId={school.id}
      schoolName={school.name}
    />
  );
}
