import React from "react";
import { notFound } from "next/navigation";
import { basePrisma } from "@/lib/tenant-prisma";
import WalkInIntakeClient from "./WalkInIntakeClient";

export default async function WalkInAdmissionsPage({
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
    include: {
      classrooms: { select: { id: true, name: true } },
    },
  });

  if (!school) {
    notFound();
  }

  return (
    <WalkInIntakeClient
      schoolId={school.id}
      schoolName={school.name}
      subdomain={school.subdomain}
      classrooms={school.classrooms}
    />
  );
}
