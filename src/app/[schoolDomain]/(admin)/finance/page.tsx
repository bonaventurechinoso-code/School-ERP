import React from "react";
import { basePrisma, getTenantClient } from "@/lib/tenant-prisma";
import FinanceDashboard from "./FinanceDashboard";

export default async function FinancePage({ params: paramsPromise }: { params: Promise<{ schoolDomain: string }> }) {
  const params = await paramsPromise;
  
  const school = await basePrisma.school.findUnique({
    where: { subdomain: params.schoolDomain },
    include: { academicTiers: true },
  });

  if (!school) {
    return (
      <div className="p-8 text-center text-slate-500">
        <h2 className="text-xl font-bold text-slate-800">Tenant Not Found</h2>
      </div>
    );
  }

  const tenantDb = getTenantClient(school.id);
  
  const students = await tenantDb.student.findMany({
    orderBy: { firstName: "asc" },
  });

  const feeTemplates = await tenantDb.feeTemplate.findMany({
    orderBy: { createdAt: "desc" },
  });

  const invoices = await tenantDb.invoice.findMany({
    include: {
      student: true,
      payments: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const transactions = await tenantDb.transaction.findMany({
    orderBy: { createdAt: "desc" },
  });

  // Calculate high level metrics
  const totalInvoiced = invoices.reduce((sum, inv) => sum + inv.amountDue, 0);
  const totalPaid = invoices.reduce((sum, inv) => {
    return sum + inv.payments.reduce((pSum, p) => pSum + p.amountPaid, 0);
  }, 0);
  const outstandingBalance = totalInvoiced - totalPaid;
  const totalExpenses = transactions
    .filter(t => t.type === 'EXPENSE')
    .reduce((sum, t) => sum + t.amount, 0);

  const hasHigherEd = school.academicTiers.some(t => 
    t.name.toLowerCase().includes("higher ed") || 
    t.name.toLowerCase().includes("university") || 
    t.name.toLowerCase().includes("college")
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      
      <header>
        <h2 className="text-3xl font-extrabold tracking-tight text-slate-800">
          Fee Tracking & Finance
        </h2>
        <p className="text-slate-500 mt-2 text-lg">
          Manage invoices, record payments, and track student balances.
        </p>
      </header>

      <FinanceDashboard 
        hasHigherEd={hasHigherEd}
        invoices={invoices}
        students={students}
        feeTemplates={feeTemplates}
        transactions={transactions}
        schoolId={school.id}
        totalInvoiced={totalInvoiced}
        totalPaid={totalPaid}
        totalExpenses={totalExpenses}
        outstandingBalance={outstandingBalance}
      />
      
    </div>
  );
}
