import React from "react";
import { getBursarContext } from "../actions";
import { BankingDeskClient } from "./BankingDeskClient";

export const metadata = {
  title: "Direct Bank Accounts | Bursar Portal",
  description: "Configure collection accounts and bank settlement details.",
};

export default async function BursarBankingPage() {
  const context = await getBursarContext();

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

  return <BankingDeskClient context={fallbackContext} />;
}
