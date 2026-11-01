import React from "react";
import { getBursarContext, getBursarReceipts } from "../actions";
import { ReceiptsDeskClient } from "./ReceiptsDeskClient";

export const metadata = {
  title: "Official Receipts | Bursar Portal",
  description: "Search, inspect, and print official bursary receipts.",
};

export default async function BursarReceiptsPage() {
  const context = await getBursarContext();
  const schoolId = context?.schoolId || "default-school";

  const fallbackContext = context || {
    staffId: "default-bursar-id",
    staffName: "Mrs. Ngozi Adeleke",
    staffEmail: "bursar@greenwood.edu.ng",
    staffRole: "School Bursar",
    schoolId: "default-school",
    schoolName: "Greenwood Academy",
    schoolSubdomain: "greenwood",
    settlementBankName: "Access Bank Plc",
    settlementAccountNumber: "0123456789",
    settlementAccountName: "Greenwood Academy - Tuition Account",
    activeTiers: ["Creche", "Primary School", "Secondary School"],
  };

  const receiptsData = await getBursarReceipts(schoolId, { limit: 50 });

  return (
    <ReceiptsDeskClient
      context={fallbackContext}
      initialReceipts={receiptsData.receipts}
      totalCount={receiptsData.totalCount}
    />
  );
}
