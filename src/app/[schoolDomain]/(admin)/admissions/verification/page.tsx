import React from "react";
import { notFound } from "next/navigation";
import { basePrisma } from "@/lib/tenant-prisma";
import { fetchApplicationsForVerification } from "./actions";
import VerificationDeskClient from "./VerificationDeskClient";

export default async function AdmissionsVerificationPage({
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

  const { applications } = await fetchApplicationsForVerification(school.id);

  return (
    <VerificationDeskClient
      initialApplications={applications as any}
      schoolId={school.id}
      schoolName={school.name}
    />
  );
}
