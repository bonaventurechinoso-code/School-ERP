import React from "react";
import { notFound } from "next/navigation";
import { basePrisma } from "@/lib/tenant-prisma";
import ResetPasswordClient from "./ResetPasswordClient";

export default async function TenantResetPasswordPage({
  params: paramsPromise,
  searchParams: searchParamsPromise,
}: {
  params: Promise<{ schoolDomain: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { schoolDomain } = await paramsPromise;
  const searchParams = await searchParamsPromise;

  const school = await basePrisma.school.findFirst({
    where: {
      OR: [
        { subdomain: schoolDomain.toLowerCase().trim() },
        { slug: schoolDomain.toLowerCase().trim() },
      ],
    },
  });

  if (!school) {
    return notFound();
  }

  const brandColor = (school as any)?.branding?.primaryColor || "#3b82f6";

  return (
    <ResetPasswordClient
      schoolName={school.name}
      schoolDomain={school.subdomain}
      brandColor={brandColor}
      initialToken={searchParams.token || ""}
    />
  );
}
