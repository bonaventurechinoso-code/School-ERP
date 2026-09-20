import React from "react";
import { getBursarContext, getBursarFeeTemplates } from "../actions";
import { FeesDeskClient } from "./FeesDeskClient";

export const metadata = {
  title: "Fee Structures & Tariffs | Bursar Portal",
  description: "Configure tuition schedules, PTA levies, and sundry billing templates.",
};

export default async function BursarFeesPage() {
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
    activeTiers: ["Daycare", "Primary School", "Secondary School"],
  };

  const data = await getBursarFeeTemplates(schoolId);

  return (
    <FeesDeskClient
      context={fallbackContext}
      initialTemplates={data.templates || []}
    />
  );
}
