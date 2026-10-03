import React from "react";
import { basePrisma } from "@/lib/tenant-prisma";
import ResetPasswordClient from "@/app/[schoolDomain]/reset-password/ResetPasswordClient";

export default async function UniversalResetPasswordPage({
  searchParams: searchParamsPromise,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const searchParams = await searchParamsPromise;
  const school = (await basePrisma.school.findFirst({
    where: { isActive: true },
  })) || (await basePrisma.school.findFirst());

  return (
    <ResetPasswordClient
      schoolName={school?.name || "School ERP Platform"}
      schoolDomain={school?.subdomain || "platform"}
      brandColor={(school as any)?.branding?.primaryColor || "#3b82f6"}
      initialToken={searchParams?.token || ""}
    />
  );
}
