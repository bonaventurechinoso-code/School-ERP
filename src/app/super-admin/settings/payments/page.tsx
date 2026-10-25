import React from "react";
import PaymentSettingsManager from "@/components/payments/PaymentSettingsManager";

export const metadata = {
  title: "Platform Payment Activation Defaults | Super Admin",
  description: "Configure system-wide payment activation defaults and baseline fee templates",
};

export default function SuperAdminPaymentSettingsPage() {
  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <PaymentSettingsManager tenantId="super-admin" isSuperAdmin={true} />
    </div>
  );
}
