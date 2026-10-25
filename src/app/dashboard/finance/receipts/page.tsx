import React from "react";
import BursarReceiptsHub from "@/components/payments/BursarReceiptsHub";

export const metadata = {
  title: "Receipts Clearing Hub | Bursary Finance",
  description: "Universal Payment Receipt Verification & Clearance Desk",
};

export default function BursarFinanceReceiptsPage() {
  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <BursarReceiptsHub isSuperAdmin={false} />
    </div>
  );
}
