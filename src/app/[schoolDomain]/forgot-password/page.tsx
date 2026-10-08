import React from "react";
import { notFound } from "next/navigation";
import { basePrisma } from "@/lib/tenant-prisma";
import ForgotPasswordFormClient from "./ForgotPasswordFormClient";

export default async function TenantForgotPasswordPage({
  params: paramsPromise,
}: {
  params: Promise<{ schoolDomain: string }>;
}) {
  const { schoolDomain } = await paramsPromise;

  if (!schoolDomain) {
    return notFound();
  }

  const normalizedDomain = schoolDomain.toLowerCase().trim();

  const school = await basePrisma.school.findFirst({
    where: {
      OR: [
        { subdomain: normalizedDomain },
        { slug: normalizedDomain },
      ],
      isActive: true,
      deletedAt: null,
    },
  });

  if (!school) {
    return notFound();
  }

  const brandColor = (school as any)?.branding?.primaryColor || "#3b82f6";
  const schoolLogo = (school as any)?.logo || (school as any)?.branding?.logoUrl || undefined;

  return (
    <ForgotPasswordFormClient
      schoolName={school.name}
      schoolDomain={school.subdomain || school.slug || normalizedDomain}
      brandColor={brandColor}
      schoolLogo={schoolLogo}
    />
  );
}
