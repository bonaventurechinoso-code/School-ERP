import React from "react";
import { basePrisma } from "@/lib/tenant-prisma";
import PaymentSettingsManager from "@/components/payments/PaymentSettingsManager";

export const metadata = {
  title: "Payment & Fee Activation Settings | School Admin",
  description: "Configure which fees your institution activates and charges students and parents",
};

export default async function TenantPaymentSettingsPage({
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
      <PaymentSettingsManager
        tenantId={tenantId}
        schoolName={schoolName}
        isSuperAdmin={false}
      />
    </div>
  );
}
