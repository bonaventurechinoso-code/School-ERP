export const dynamic = 'force-dynamic';
import React from "react";
import { getBursarContext, getBursarInvoices, getBursarFeeTemplates } from "../actions";
import { basePrisma } from "@/lib/tenant-prisma";
import { InvoicesDeskClient } from "./InvoicesDeskClient";

export const metadata = {
  title: "Student Invoices & Billing | Bursar Portal",
  description: "Manage student invoices, batch billing, and fee ledgers.",
};

export default async function BursarInvoicesPage() {
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

  const [invoicesData, classroomsRaw, templatesData] = await Promise.all([
    getBursarInvoices(schoolId, { limit: 50 }),
    basePrisma.student.findMany({
      where: { schoolId, currentClass: { not: null } },
      select: { currentClass: true },
      distinct: ["currentClass"],
    }),
    getBursarFeeTemplates(schoolId),
  ]);

  const classrooms = classroomsRaw
    .map((c) => c.currentClass)
    .filter((c): c is string => Boolean(c))
    .sort();

  const templates = (templatesData.templates || []).map((t) => ({
    id: t.id,
    name: t.name,
    defaultAmount: t.defaultAmount,
  }));

  return (
    <InvoicesDeskClient
      context={fallbackContext}
      initialInvoices={invoicesData.invoices}
      totalCount={invoicesData.totalCount}
      classrooms={classrooms}
      templates={templates}
    />
  );
}
