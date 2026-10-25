import React from "react";
import { headers } from "next/headers";
import PaymentSettingsManager from "@/components/payments/PaymentSettingsManager";

export const metadata = {
  title: "Payment & Fee Activation Settings | School Admin",
  description: "Configure which fees your institution activates and charges students and parents",
};

export default async function DashboardPaymentSettingsPage() {
  const headersList = await headers();
  const tenantId =
    headersList.get("x-tenant-id") ||
    headersList.get("x-school-id") ||
    "default";

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <PaymentSettingsManager tenantId={tenantId} isSuperAdmin={false} />
    </div>
  );
}
