import React from "react";
import { basePrisma } from "@/lib/tenant-prisma";
import BursarReceiptsHub from "@/components/payments/BursarReceiptsHub";

export const metadata = {
  title: "Receipts Clearing Hub | Bursary Finance",
  description: "Universal Payment Receipt Verification & Clearance Desk",
};

export default async function TenantFinanceReceiptsPage({
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
    select: { id: true, name: true },
  });

  const tenantId = school?.id || schoolDomain;
  const schoolName = school?.name || `${schoolDomain} School`;

  return (
    <div className="py-4 max-w-7xl mx-auto space-y-6">
      <BursarReceiptsHub
        tenantId={tenantId}
        schoolName={schoolName}
        isSuperAdmin={false}
      />
    </div>
  );
}
