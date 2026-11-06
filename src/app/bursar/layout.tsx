import React from "react";
import { getBursarContext, BursarContext } from "./actions";
import { BursarShell } from "./BursarShell";
import { basePrisma } from "@/lib/tenant-prisma";

export const metadata = {
  title: "Bursar Portal | School ERP",
  description: "Institutional Bursary & Financial Command Center: tuition collection, bank transfer verification, student billing, and official receipts.",
};

export default async function BursarLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const context = await getBursarContext();

  const fallbackContext: BursarContext = context || {
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

  let pendingVerificationsCount = 0;
  try {
    const { reconcileAdmissionFeeReceipts } = await import("@/lib/payment-receipt-service");
    await reconcileAdmissionFeeReceipts(fallbackContext.schoolId).catch(() => null);
    const [proofCount, receiptCount] = await Promise.all([
      basePrisma.paymentProof
        .count({
          where: {
            schoolId: fallbackContext.schoolId,
            status: "PENDING",
          },
        })
        .catch(() => 0),
      basePrisma.paymentReceipt
        .count({
          where: {
            OR: [{ tenantId: fallbackContext.schoolId }, { schoolId: fallbackContext.schoolId }],
            status: "PENDING",
          },
        })
        .catch(() => 0),
    ]);
    pendingVerificationsCount = proofCount + receiptCount;
  } catch {
    pendingVerificationsCount = 0;
  }

  return (
    <BursarShell
      bursarContext={fallbackContext}
      pendingVerificationsCount={pendingVerificationsCount}
    >
      {children}
    </BursarShell>
  );
}
