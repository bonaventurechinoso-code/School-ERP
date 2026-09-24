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
    <ForgotPasswordFormClient
      schoolName={school.name}
      schoolDomain={school.subdomain}
      brandColor={brandColor}
    />
  );
}
