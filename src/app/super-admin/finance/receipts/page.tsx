import React from "react";
import BursarReceiptsHub from "@/components/payments/BursarReceiptsHub";

export const metadata = {
  title: "Platform Receipts & Subscriptions | Super Admin",
  description: "Cross-School Payment Receipt Verification & Platform Subscription Clearance",
};

export default function SuperAdminFinanceReceiptsPage() {
  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <BursarReceiptsHub isSuperAdmin={true} tenantId="super-admin" />
    </div>
  );
}
