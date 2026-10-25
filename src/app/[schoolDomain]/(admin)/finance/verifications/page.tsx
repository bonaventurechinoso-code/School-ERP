import React from "react";
import { basePrisma } from "@/lib/tenant-prisma";
import BursarReceiptsHub from "@/components/payments/BursarReceiptsHub";

export const metadata = {
  title: "Payment Verifications | Bursar Clearing Hub",
  description: "Universal Payment Receipt Verification & Clearance Desk",
};

export default async function VerificationsPage({
  params: paramsPromise,
}: {
  params: Promise<{ schoolDomain: string }>;
}) {
  const params = await paramsPromise;
  const schoolDomain = params.schoolDomain;

  const school = await basePrisma.school.findFirst({
    where: {
      OR: [
        { subdomain: schoolDomain.toLowerCase().trim() },
        { slug: schoolDomain.toLowerCase().trim() },
      ],
    },
    select: { id: true, name: true },
  });

  const tenantId = school?.id || schoolDomain;
  const schoolName = school?.name || `${schoolDomain} School`;

  return (
    <div className="py-4 space-y-6">
      <BursarReceiptsHub
        tenantId={tenantId}
        schoolName={schoolName}
        isSuperAdmin={false}
      />
    </div>
  );
}

