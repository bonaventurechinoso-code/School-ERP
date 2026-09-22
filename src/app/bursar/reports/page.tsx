export const dynamic = 'force-dynamic';
import React from "react";
import { getBursarContext, getBursarDefaultersReport } from "../actions";
import { basePrisma } from "@/lib/tenant-prisma";
import { ReportsDeskClient } from "./ReportsDeskClient";

export const metadata = {
  title: "Defaulters & Reports | Bursar Portal",
  description: "Debtors ledger, outstanding balance breakdown, and CSV audit reports.",
};

export default async function BursarReportsPage() {
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

  const [defaultersData, classroomsRaw] = await Promise.all([
    getBursarDefaultersReport(schoolId),
    basePrisma.student.findMany({
      where: { schoolId, currentClass: { not: null } },
      select: { currentClass: true },
      distinct: ["currentClass"],
    }),
  ]);

  const classrooms = classroomsRaw
    .map((c) => c.currentClass)
    .filter((c): c is string => Boolean(c))
    .sort();

  return (
    <ReportsDeskClient
      context={fallbackContext}
      initialDefaulters={defaultersData.defaulters}
      totalOutstanding={defaultersData.totalOutstanding}
      count={defaultersData.count}
      classrooms={classrooms}
    />
  );
}
