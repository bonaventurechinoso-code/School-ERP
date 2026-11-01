import React from "react";
import { getBursarContext } from "../actions";
import { CollectPaymentClient } from "./CollectPaymentClient";

export const metadata = {
  title: "Fee Collection Counter | Bursar Portal",
  description: "Rapid counter fee collection and instant official bursary receipt issuance.",
};

export default async function BursarCollectPage() {
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

  return <CollectPaymentClient context={fallbackContext} />;
}
